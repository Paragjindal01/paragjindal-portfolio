# Greeting audio

Place the final AI-generated voice file here as:

    robot-welcome.mp3

Served at `/audio/robot-welcome.mp3` (the path the greeting player uses).

## Current placeholder

`robot-welcome.m4a` is a PLACEHOLDER voice generated with macOS TTS
("Daniel", en-GB). The player tries `robot-welcome.mp3` first, so simply
adding the final MP3 replaces the placeholder — no code change needed.
Delete the .m4a once the MP3 exists.

## Script (exact)

> "Hi, I'm Parag's digital assistant. Parag builds websites, AI solutions,
> and helps solve everyday technology problems. Explore his work, check out
> his services, or get in touch."

## Voice spec

Male, friendly, confident, professional, natural, neutral English accent,
slightly futuristic but not robotic, medium speed, ~10–14 seconds.

Generate with any TTS service (e.g. ElevenLabs, OpenAI TTS, PlayHT) from
their dashboard or a local script — never call a TTS API from the site's
frontend. Export as MP3, drop the file in this folder, commit, and push.

Until the file exists, the site automatically falls back to browser speech
synthesis, then to timed captions — nothing breaks.

## Caption timing

Captions use three segments that switch at ~0%, ~28%, and ~68% of the audio
duration (see `src/components/robot/robotGreeting.js`). If your generated
narration paces very differently, tweak the `at` values there.
