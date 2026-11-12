# Synthetic media fixtures (tests only)

Generated with `ffmpeg -f lavfi -i testsrc` (FFmpeg's built-in colour-bar test pattern). They show no traffic
situation, are not educational content and are never bundled into the app or deployed; the browser test serves
them through a request intercept only.

    ffmpeg -f lavfi -i "testsrc=size=640x360:rate=25" -t 1 -c:v libvpx -b:v 200k sample-test-pattern.webm
    ffmpeg -f lavfi -i "testsrc=size=640x360" -frames:v 1 sample-test-pattern.png
