# Greeting audio

The site serves the same prerecorded introduction as `robot-welcome.mp3` and
`robot-welcome.m4a`. It uses the macOS Samantha voice in American English,
recorded locally at 160 words per minute and normalized to approximately −19 LUFS.

The caption transcript and cue positions are in
`src/components/robot/robotGreeting.js`. The four sentences begin near 0.00,
4.32, 9.74, and 20.31 seconds in the 22.17-second recording. Update the clip
duration and cue positions together if you replace the recording.

If neither audio format can play, the greeting can use browser speech
synthesis or timed captions.
