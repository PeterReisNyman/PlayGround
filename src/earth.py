import ee
ee.Authenticate()
ee.Initialize()

# Load an image collection (Landsat 8)
col = (ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
       .filterBounds(ee.Geometry.Point(-122.3, 37.8))
       .filterDate("2020-01-01", "2020-12-31")
       .select(["SR_B4","SR_B3","SR_B2"]))

# Visualization params
vis = {"min": 0, "max": 30000}

# Video export
task = ee.batch.Export.video.toDrive(
    collection=col,
    description="landsat_timelapse",
    framesPerSecond=10,
    region=ee.Geometry.Rectangle([-122.5, 37.6, -122.1, 37.9]),
    scale=30
)

task.start()