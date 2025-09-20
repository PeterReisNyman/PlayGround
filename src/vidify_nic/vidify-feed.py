import pygame
import random
import threading
import time
from bisect import bisect_left

# Controls - edit these variables to adjust simulation
BANDWIDTH_MBPS = 10.0  # Network bandwidth in Mbps (megabits per second)
MIN_VIDEO_DURATION_SEC = 20
MAX_VIDEO_DURATION_SEC = 300  # Max video length in seconds (clips longer videos)
MAX_QUALITY = 'high'  # Max quality: 'low', 'med', or 'high' (affects bitrate and size)
NUM_VIDEOS = 20  # Number of videos in the feed
VIDEO_HEIGHT = 200  # Pixel height of each video placeholder
CHUNK_DURATION_SEC = 10  # Load videos in chunks of this many seconds
PRELOAD_DISTANCE_FACTOR = 1.5  # Start preloading if video is within this factor of screen height
MEAN_VIDEO_DURATION = 30  # Mean video duration in seconds
VIDEO_DURATION_STD = 10  # Standard deviation for video duration

# Quality to bitrate mapping (Mbps)
QUALITY_BITRATES = {
    'low': 1.0,
    'med': 3.0,
    'high': 5.0
}

# Map max quality to allowed levels
ALLOWED_QUALITIES = list(QUALITY_BITRATES.keys())[:list(QUALITY_BITRATES.keys()).index(MAX_QUALITY) + 1]

# Automatic user simulation parameters
SCROLL_SPEED_BASE = 100  # Base scroll speed in pixels per second
DIRECTION_CHANGE_INTERVAL = 5.0  # Seconds between possible direction changes
JUMP_INTERVAL = 10.0  # Seconds between possible jumps in visible videos

# ========================
# Structural part
# ========================

class Video:
    def __init__(self, id):
        self.id = id
        # Normal distribution for duration, clamped
        duration = random.gauss(MEAN_VIDEO_DURATION, VIDEO_DURATION_STD)
        self.duration = min(max(MIN_VIDEO_DURATION_SEC, duration), MAX_VIDEO_DURATION_SEC)
        self.quality = random.choice(ALLOWED_QUALITIES)
        self.bitrate_mbps = QUALITY_BITRATES[self.quality]
        self.size_mb = (self.duration * self.bitrate_mbps) / 8  # Convert to megabytes (Mbps to MB)
        self.loaded_mb = 0.0
        self.watched_intervals = []  # List of (start_sec, end_sec) watched
        self.current_position = 0.0
        self.loading = False
        self.last_in_view = False
        self.lock = threading.RLock()  # Re-entrant to allow nested access

    def start_loading(self, bandwidth_mbps):
        with self.lock:
            if not self.loading and self.loaded_mb < self.size_mb:
                self.loading = True
                loader = threading.Thread(target=self._load, args=(bandwidth_mbps,), daemon=True)
                loader.start()

    def _load(self, bandwidth_mbps):
        chunk_size_mb = (CHUNK_DURATION_SEC * self.bitrate_mbps) / 8
        while self.loaded_mb < self.size_mb:
            with self.lock:
                to_load = min(chunk_size_mb, self.size_mb - self.loaded_mb)
            time_to_load = to_load / (bandwidth_mbps / 8)  # Time in seconds (MB / (Mbps/8 MB/s))
            time.sleep(time_to_load)  # Simulate loading time
            with self.lock:
                self.loaded_mb += to_load
                if self.loaded_mb >= self.size_mb:
                    self.loading = False
                    break

    def play(self, dt):
        with self.lock:
            loaded_sec = (self.loaded_mb / self.size_mb) * self.duration if self.size_mb > 0 else 0
            if self.current_position < loaded_sec and self.current_position < self.duration:
                end = min(self.current_position + dt, loaded_sec, self.duration)
                self.add_watched_interval(self.current_position, end)
                self.current_position = end

    def jump(self):
        with self.lock:
            self.current_position = random.uniform(0, self.duration)

    def reset(self):
        with self.lock:
            self.watched_intervals = []
            self.current_position = 0.0

    def add_watched_interval(self, start, end):
        if start >= end:
            return
        # Insert and merge intervals
        intervals = self.watched_intervals
        idx = bisect_left([i[0] for i in intervals], start)
        intervals.insert(idx, (start, end))
        # Merge
        merged = []
        for interval in intervals:
            if not merged or merged[-1][1] < interval[0]:
                merged.append(interval)
            else:
                merged[-1] = (merged[-1][0], max(merged[-1][1], interval[1]))
        self.watched_intervals = merged

    def get_loaded_sec(self):
        return (self.loaded_mb / self.size_mb) * self.duration if self.size_mb > 0 else 0

    def is_buffering(self):
        return self.current_position >= self.get_loaded_sec()

# ========================
# Algorithm to minimize downtime
# ========================

def get_preload_candidates(videos, scroll_y, screen_height):
    candidates = []
    for video in videos:
        video_y = video.id * VIDEO_HEIGHT - scroll_y
        distance = abs(video_y - screen_height / 2)
        if distance < screen_height * PRELOAD_DISTANCE_FACTOR:
            candidates.append((distance, video.id))  # Keep tuple comparable even on ties
    candidates.sort()  # Sorts by distance then id
    return [videos[idx] for _, idx in candidates]

def manage_loading(videos, scroll_y, screen_height, bandwidth_mbps):
    candidates = get_preload_candidates(videos, scroll_y, screen_height)
    # Start loading for top candidates (e.g., up to 3 concurrent)
    concurrent_limit = 3  # Simulate iPhone NIC threads
    loading_count = sum(1 for v in videos if v.loading)
    for video in candidates:
        if loading_count >= concurrent_limit:
            break
        video.start_loading(bandwidth_mbps / max(1, loading_count + 1))  # Share bandwidth, update count first? No, increment after
        loading_count += 1

# ========================
# Visual part
# ========================

def draw_video(screen, video, video_y, bar_width, font, screen_height):
    # Draw video placeholder as black to simulate video screen
    # pygame.draw.rect(screen, (0, 0, 0), (50, video_y, bar_width + 20, VIDEO_HEIGHT - 20))

    bar_x = 60
    bar_y_loaded = video_y + 50
    bar_y_watched = video_y + 70
    bar_height = 10

    # Green loaded bar (single segment)
    loaded_width = bar_width * (video.loaded_mb / video.size_mb) if video.size_mb > 0 else 0
    pygame.draw.rect(screen, (0, 255, 0), (bar_x, bar_y_loaded, loaded_width, bar_height))

    # Blue watched bars (multiple segments)
    for start, end in video.watched_intervals:
        start_x = bar_x + (start / video.duration) * bar_width
        end_x = bar_x + (end / video.duration) * bar_width
        pygame.draw.rect(screen, (0, 0, 255), (start_x, bar_y_watched, end_x - start_x, bar_height))

    # Current position ball
    pos_x = bar_x + (video.current_position / video.duration) * bar_width
    ball_color = (255, 0, 0) if video.is_buffering() else (0, 0, 255)
    pygame.draw.circle(screen, ball_color, (int(pos_x), int(bar_y_watched + bar_height / 2)), 8)

    # Show buffering text if buffering
    in_view = 0 <= video_y <= screen_height - VIDEO_HEIGHT
    if video.is_buffering() and in_view:
        buffering_text = font.render("Buffering...", True, (255, 0, 0))
        screen.blit(buffering_text, (60, video_y + 100))

# ========================
# Main simulation
# ========================

def main():
    pygame.init()
    screen_width = 800
    screen_height = 600
    screen = pygame.display.set_mode((screen_width, screen_height))
    pygame.display.set_caption("Video Loading Simulation")
    clock = pygame.time.Clock()
    font = pygame.font.SysFont(None, 24)

    videos = [Video(i) for i in range(NUM_VIDEOS)]
    scroll_y = 0
    running = True

    total_height = NUM_VIDEOS * VIDEO_HEIGHT

    print("Automatic simulation running. Close window to exit.")
    print("Edit variables at the top of the code to change parameters.")

    while running:
        dt = clock.tick(60) / 1000.0  # Delta time in seconds

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

        keys = pygame.key.get_pressed()
        if keys[pygame.K_DOWN] or keys[pygame.K_s]:
            scroll_y += SCROLL_SPEED_BASE * dt
        if keys[pygame.K_UP] or keys[pygame.K_w]:
            scroll_y -= SCROLL_SPEED_BASE * dt
        scroll_y = max(0, min(scroll_y, total_height - screen_height))

        # Manage loading (minimize downtime)
        manage_loading(videos, scroll_y, screen_height, BANDWIDTH_MBPS)

        screen.fill((255, 255, 255))  # White background

        bar_width = screen_width - 120

        for video in videos:
            video_y = video.id * VIDEO_HEIGHT - scroll_y
            if video_y + VIDEO_HEIGHT < 0 or video_y > screen_height:
                continue  # Off-screen, skip draw

            # In-view check
            in_view = 0 <= video_y <= screen_height - VIDEO_HEIGHT

            with video.lock:
                if in_view:
                    if not video.last_in_view and (video.watched_intervals or video.current_position > 0):
                        video.reset()  # Restart if scrolled away and back
                    video.play(dt)
                    video.last_in_view = True
                else:
                    video.last_in_view = False

            # Draw
            draw_video(screen, video, video_y, bar_width, font, screen_height)

        # Global info
        bandwidth_text = f"Bandwidth: {BANDWIDTH_MBPS} Mbps (edit code to change)"
        screen.blit(font.render(bandwidth_text, True, (0, 0, 0)), (10, screen_height - 30))

        pygame.display.flip()

    pygame.quit()

if __name__ == "__main__":
    main()
