import random
import threading
import time
from bisect import bisect_left
import pygame

# The purpose of this project is to simulate an iOS mobile receiving
# feed from a aws(s3/cloudfront), supabase distribution
# any ILLIGAL ACTIONS meaning that they are not aligned with how any of
# thses system works MUST BE imidetly reported before any other priority


# TIME MULTIPLIER
TIME_MULTIPLIER = 1.0

# Controls - edit these variables to adjust simulation
BANDWIDTH_MBPS = 10.0  # Network bandwidth in Mbps (megabits per second)

# VIDEO DURATION CONTROL
MIN_VIDEO_DURATION_SEC = 20 # Min video length in seconds
MAX_VIDEO_DURATION_SEC = 300 # Max video length in seconds

MEAN_VIDEO_DURATION = 30  # Mean video duration in seconds
VIDEO_DURATION_STD = 10  # Standard deviation for video duration

# VIDEO SIZE CONTROL
MIN_FRAME_RATE = 24 # Min video fps
MAX_FRAME_RATE = 60 # Max video fps

MEAN_FRAME_RATE = 40  # Mean video fps
FRAME_RATE_STD = 10 # Standard deviation for fps

# VIDEO SIZE CONTROL
MIN_VIDEO_SIZE = 420 # Min video Y_SIZE in pixels
MAX_VIDEO_SIZE = 1920 # Max video Y_SIZE in pixels

MEAN_Y_SIZE = 1920  # Mean video Y_SIZE in pixels
Y_SIZE_STD = 640/3 # Standard deviation for Y_SIZE in pixels
MEAN_X_SIZE = 1080  # Mean video X_SIZE in pixels
X_SIZE_STD = 360/3  # Standard deviation for X_SIZE in pixels

# ENCODING MODEL
BITS_PER_PIXEL = 0.07  # Effective bits per pixel per frame
MIN_BITRATE_MBPS = 0.5
MAX_BITRATE_MBPS = 25.0

# STRATEGY
PRELOAD_DISTANCE_FACTOR = 1.5  # Start preloading if video is within this factor of screen height


# Automatic user simulation parameters
DIRECTION_CHANGE_INTERVAL = 5.0  # Seconds between possible direction changes
JUMP_INTERVAL = 10.0  # Seconds between possible jumps in visible videos

SCREEN_HEIGHT = 1080.0
CHUNK_DURATION_SEC = 4.0

# ========================
# Structural part
# ========================


class Video:
    def __init__(self, id):
        self.id = id
        # Normal distribution
        duration = random.gauss(MEAN_VIDEO_DURATION, VIDEO_DURATION_STD)
        self.duration = min(max(MIN_VIDEO_DURATION_SEC, duration), MAX_VIDEO_DURATION_SEC)

        frame_rate = random.gauss(MEAN_FRAME_RATE, FRAME_RATE_STD)
        self.frame_rate = min(max(MIN_FRAME_RATE, frame_rate), MAX_FRAME_RATE)

        y_size = random.gauss(MEAN_Y_SIZE, Y_SIZE_STD)
        self.y_size = min(max(MIN_VIDEO_SIZE, y_size), MAX_VIDEO_SIZE)

        x_size = random.gauss(MEAN_X_SIZE, X_SIZE_STD)
        self.x_size = min(max(MIN_VIDEO_SIZE, x_size), MAX_VIDEO_SIZE)


        raw_bitrate = (self.frame_rate * self.y_size * self.x_size * BITS_PER_PIXEL) / 1_000_000
        self.bitrate_mbps = min(MAX_BITRATE_MBPS, max(MIN_BITRATE_MBPS, raw_bitrate))
        self.size_mb = (self.duration * self.bitrate_mbps) / 8  # Convert to megabytes (Mbps to MB)


        self.loaded_intervals = []  # List of (start_sec, end_sec) loaded times
        self.watched_intervals = []  # List of (start_sec, end_sec) watched
        self.current_position = 0.0
        self.is_playing = False

        self.loading = False
        self.lock = threading.RLock()  # Re-entrant to allow nested access


class Nic:
    def __init__(self, max_flows=5):
        self.bandwidth_mbps = BANDWIDTH_MBPS
        self.max_flows = max_flows
        self.lock = threading.RLock()
        self.active_flows = 0

    def request_bandwidth(self):
        with self.lock:
            if self.active_flows < self.max_flows:
                self.active_flows += 1
                return self.bandwidth_mbps / max(1, self.active_flows)
            return 0  # no bandwidth available

    def release_bandwidth(self):
        with self.lock:
            self.active_flows = max(0, self.active_flows - 1)


class Feed:
    def __init__(self):
        self.videos = []
        self.total_height = 0.0

    def add_video(self):
        video = Video(len(self.videos))
        self.videos.append(video)
        self.total_height += video.y_size


class User:
    def __init__(self, feed):
        self.feed = feed
        self.scroll_position = 0.0
        self.scroll_speed = 0.0
        self.current_direction = 1
        self.lock = threading.RLock()

    def jump(self):
        with self.lock:
            jump_pixels = random.uniform(SCREEN_HEIGHT, 5 * SCREEN_HEIGHT) * self.current_direction
            self.scroll_position += jump_pixels
            self.scroll_position = max(0, min(self.scroll_position, self.feed.total_height - SCREEN_HEIGHT))

    def get_current_video_index(self):
        with self.lock:
            cum = 0.0
            for i, v in enumerate(self.feed.videos):
                if cum <= self.scroll_position < cum + v.y_size:
                    return i
                cum += v.y_size
            return len(self.feed.videos) - 1


# ========================
# Algorithm to minimize downtime
# ========================

def add_interval(intervals, start, end):
    if start >= end:
        return
    # Insert and merge
    intervals.append([start, end])
    intervals.sort(key=lambda x: x[0])
    merged = []
    for intv in intervals:
        if not merged or merged[-1][1] < intv[0]:
            merged.append(intv)
        else:
            merged[-1][1] = max(merged[-1][1], intv[1])
    intervals[:] = merged

def find_next_unloaded(video, from_sec):
    intervals = sorted(video.loaded_intervals, key=lambda x: x[0])
    current = from_sec
    for start, end in intervals:
        if current < start:
            return current
        if current < end:
            current = end
    return current

def is_fully_loaded(video):
    if not video.loaded_intervals:
        return False
    intervals = sorted(video.loaded_intervals, key=lambda x: x[0])
    if intervals[0][0] > 0:
        return False
    current_end = intervals[0][1]
    for i in range(1, len(intervals)):
        if current_end < intervals[i][0]:
            return False
        current_end = max(current_end, intervals[i][1])
    return current_end >= video.duration

def load_video(video, nic, stop_event, priority_start=None):
    with video.lock:
        if video.loading:
            return
        video.loading = True
    bw = nic.request_bandwidth()
    if bw == 0 or stop_event.is_set():
        with video.lock:
            video.loading = False
        if bw != 0:
            nic.release_bandwidth()
        return
    try:
        load_start = priority_start if priority_start is not None else 0
        while True:
            if stop_event.is_set():
                break
            next_start = find_next_unloaded(video, load_start)
            if next_start >= video.duration:
                next_start = find_next_unloaded(video, 0)
                if next_start >= video.duration:
                    break
            chunk_end = min(video.duration, next_start + CHUNK_DURATION_SEC)
            chunk_sec = chunk_end - next_start
            size_mb = chunk_sec * video.bitrate_mbps / 8
            load_time = (size_mb * 8) / bw
            if stop_event.wait(load_time * TIME_MULTIPLIER):
                break
            with video.lock:
                add_interval(video.loaded_intervals, next_start, chunk_end)
            load_start = chunk_end
    finally:
        with video.lock:
            video.loading = False
        nic.release_bandwidth()

def manage_loading(feed, user, nic, stop_event):
    while not stop_event.is_set():
        videos_to_load = []
        preload_dist = PRELOAD_DISTANCE_FACTOR * SCREEN_HEIGHT
        with user.lock:
            view_top = user.scroll_position
        view_bottom = view_top + SCREEN_HEIGHT
        preload_top = max(0, view_top - preload_dist)
        preload_bottom = view_bottom + preload_dist
        cum = 0.0
        current_index = user.get_current_video_index()
        current_video = feed.videos[current_index]
        for i, v in enumerate(feed.videos):
            v_top = cum
            v_bottom = cum + v.y_size
            if v_bottom > preload_top and v_top < preload_bottom:
                with v.lock:
                    if not is_fully_loaded(v):
                        dist = abs((v_top + v.y_size / 2) - (view_top + SCREEN_HEIGHT / 2))
                        videos_to_load.append((v, dist, i == current_index))
            cum += v.y_size
        videos_to_load.sort(key=lambda x: (not x[2], x[1]))  # Prioritize current
        for v, _, is_current in videos_to_load:
            with v.lock:
                if not v.loading:
                    ps = v.current_position if is_current else None
                    threading.Thread(
                        target=load_video,
                        args=(v, nic, stop_event, ps),
                        daemon=True,
                    ).start()
        if stop_event.wait(1.0):
            break

# ========================
# User and play simulation
# ========================

def user_simulation(user, stop_event):
    while not stop_event.is_set():
        action = random.choice(['scroll', 'jump', 'stop'])
        if action == 'stop':
            with user.lock:
                user.scroll_speed = 0.0
            watch_time = random.uniform(5, 30)
            if stop_event.wait(watch_time):
                break
        elif action == 'scroll':
            with user.lock:
                user.current_direction = random.choice([-1, 1])
                user.scroll_speed = random.uniform(100, 1000)
            scroll_time = random.uniform(1, 5)
            start_time = time.time()
            while time.time() - start_time < scroll_time and not stop_event.is_set():
                dt = 0.05
                with user.lock:
                    user.scroll_position += user.scroll_speed * user.current_direction * dt
                    user.scroll_position = max(0, min(user.scroll_position, user.feed.total_height - SCREEN_HEIGHT))
                if stop_event.wait(dt):
                    break
            with user.lock:
                user.scroll_speed = 0.0
        elif action == 'jump':
            user.jump()

    with user.lock:
        user.scroll_speed = 0.0

def play_simulation(user, stop_event):
    while not stop_event.is_set():
        dt = 0.1
        with user.lock:
            index = user.get_current_video_index()
            speed = abs(user.scroll_speed)
        if speed > 10:
            with user.feed.videos[index].lock:
                user.feed.videos[index].is_playing = False
            if stop_event.wait(dt * TIME_MULTIPLIER):
                break
            continue
        video = user.feed.videos[index]
        with video.lock:
            pos = video.current_position
            is_loaded = any(start <= pos < end for start, end in video.loaded_intervals)
            if is_loaded and pos < video.duration:
                new_pos = min(video.duration, pos + dt)
                if new_pos > pos:
                    add_interval(video.watched_intervals, pos, new_pos)
                video.current_position = new_pos
                video.is_playing = new_pos < video.duration
            else:
                video.is_playing = False
        if stop_event.wait(dt * TIME_MULTIPLIER):
            break

# ========================
# Visual part
# ========================

class VideoLinesVisualizer:
    def __init__(self, videos, user, stop_event):
        pygame.init()
        self.screen = pygame.display.set_mode((800, 600))
        pygame.display.set_caption("FEED VISUALISER")
        self.clock = pygame.time.Clock()
        
        self.videos = videos
        self.user = user
        self.current_video_index = 0
        self.stop_event = stop_event
        
        self.run()

    def draw(self):
        self.screen.fill((0, 0, 0))  # Black background
        
        if not self.videos:
            return
        
        max_duration = max(v.duration for v in self.videos)
        max_line_width = 700
        start_x = 50
        y = 50
        line_spacing = 25
        video_pair_spacing = 30
        
        self.current_video_index = self.user.get_current_video_index()
        
        for index, video in enumerate(self.videos):
            with video.lock:
                duration = video.duration
                line_width = (duration / max_duration) * max_line_width
                
                # Load line (blue)
                blue = (0, 102, 255)
                for start, end in video.loaded_intervals:
                    segment_start_x = start_x + (start / duration) * line_width
                    segment_end_x = start_x + (end / duration) * line_width
                    
                    pygame.draw.line(self.screen, blue, (segment_start_x, y), (segment_end_x, y), 3)
                
                # Watch line (green) - below load line
                y += line_spacing
                green = (0, 255, 0)
                for start, end in video.watched_intervals:
                    segment_start_x = start_x + (start / duration) * line_width
                    segment_end_x = start_x + (end / duration) * line_width
                    
                    pygame.draw.line(self.screen, green, (segment_start_x, y), (segment_end_x, y), 3)
                
                # Current position indicator: green when actively playing, red otherwise
                if index == self.current_video_index:
                    indicator = (0, 255, 0) if video.is_playing else (255, 0, 0)
                    ball_x = start_x + (video.current_position / duration) * line_width
                    pygame.draw.circle(self.screen, indicator, (ball_x, y), 5)
                
                y += video_pair_spacing

    def run(self):
        try:
            while not self.stop_event.is_set():
                for event in pygame.event.get():
                    if event.type == pygame.QUIT:
                        self.stop_event.set()
                        return
                
                self.draw()
                pygame.display.flip()
                self.clock.tick(60)  # ~60 FPS
        finally:
            pygame.quit()

# ========================
# Main simulation
# ========================



if __name__ == "__main__":
    feed = Feed()
    for _ in range(10):
        feed.add_video()
    user = User(feed)
    nic = Nic()

    stop_event = threading.Event()
    worker_threads = [
        threading.Thread(target=user_simulation, args=(user, stop_event), daemon=True),
        threading.Thread(target=play_simulation, args=(user, stop_event), daemon=True),
        threading.Thread(target=manage_loading, args=(feed, user, nic, stop_event), daemon=True),
    ]

    for thread in worker_threads:
        thread.start()

    try:
        VideoLinesVisualizer(feed.videos, user, stop_event)
    except KeyboardInterrupt:
        stop_event.set()
    finally:
        stop_event.set()
        for thread in worker_threads:
            while thread.is_alive():
                try:
                    thread.join(timeout=0.2)
                except KeyboardInterrupt:
                    stop_event.set()
                    continue
