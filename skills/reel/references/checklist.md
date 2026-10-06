# Checklist before delivery

Use it three times:

- **Phase 3 (plan):** check every item you can check on paper.
- **Phase 5 (draft):** check every item on the contact sheet and the draft.
- **Phase 6 (final):** check the audio and the files again.

For each problem, write the time ("at 0:21"), fix `cues.ts` or the scene, render again,
and look again. Do not deliver with a known problem. If you cannot fix one, tell the user
plainly what it is and where.

## How to look

1. `node tools/render.mjs --draft`
2. `node tools/sheet.mjs`
3. Read the contact sheet image. Look at every frame, one by one.
4. For a doubtful moment, make a closer sheet of only that part, or look at single frames.

## A. Visual

1. **No sticker or card sits on a device's black frame by accident.** It is fully inside
   the screen, or it clearly crosses the side edge as a sticker. The same style all
   through the video.
2. **No tall screen scrolls into blank space.** The scroll stops at the screen's real
   bottom. No white or empty band under the app.
3. **No list ends in a half-cut item.** The last item is whole, or the scroll stops
   earlier.
4. **Never two captions on screen at once.** At each step change the old caption is gone
   before the new one comes in.
5. All text, logos, phones and stickers are inside the safe area for the shape
   (style.md section 8). Nothing is cut at the edge.
6. No text is smaller than 26 px in the final size. Text is readable on a phone.
7. Text has good contrast with what is behind it.
8. Titles use the chosen font (Figtree by default) at weight 700 to 800. No frame shows a
   fallback font.
9. No word sits alone on the last line of a title.
10. No two items overlap by mistake (a caption over a phone, a badge over a face).
11. Photos are not stretched. Faces are not cut at the eyes or chin.
12. **No name or quote next to a stock photo face.**
13. Real people photos are used for people, not cartoon avatars (unless the user asked).
14. The brand colours and the logo match the brief.
15. The first frame already has something on it. No empty first second.
16. **The last frame is a finished end card**: logo, end card text, badges, all still.

## B. Timing

17. Every voice line ends before its section ends, with at least 0.3 s of air.
18. No two voice lines overlap.
19. What the voice says matches what is on screen at that moment.
20. Every motion starts on its cue in `cues.ts`. No motion is timed by hand in the scene.
21. Section starts and key pops sit on beats after the reveal.
22. Each feature stays on screen long enough to read: at least 2.5 s.
23. The end card holds still for at least 2 s.
24. The video length matches the brief (within about 1 s).

## C. Audio

25. **The beat starts at the brand reveal**, not after it. The music starts at its drop,
    on the reveal frame.
26. No music before the reveal (unless the user asked for it).
27. A long quiet part of the track is skipped with a short crossfade, hidden under a
    whoosh or a scene change.
28. **Each different kind of motion has its own distinct sound.** No sound is reused for a
    different kind of motion.
29. Every sound effect lands on its motion (same cue time).
30. No long sound runs into the next moment. Long ones are cut with a short fade.
31. Levels start from audio.md: voice 2.3, music 0.55, ducking threshold 0.02 ratio 4
    attack 20 release 450, sound effects 0.2 to 0.8, limiter 0.94.
32. **Music clearly audible, voice clearly on top.** Checked by the loudness numbers in
    audio.md section 8, not by guessing.
33. The music fades out with the end card. No hard stop.
34. **Tell the user: "I cannot hear audio. Please listen once before you share it."**

## D. Credits

35. `CREDITS.md` lists every music track: id, title, artist, page link, licence.
36. `CREDITS.md` lists every sound effect: alias, id, title, page link, licence.
37. `CREDITS.md` lists every photo: file, Unsplash page link, photographer, licence.
38. No Unsplash+ (paid) photo is used. A photo that failed to download is not used.
39. The user's own files (logo, screens, photos) are noted as "provided by the user".

## E. Files

40. `out/<video-name>.mp4` exists, plays, and has sound.
41. `out/<video-name>-web.mp4` exists and is under 15 MB.
42. The frame size and fps match the brief (check with ffprobe if unsure).
43. Nothing from the video folder was committed or pushed. Video work stays in `~/Reels`.
44. The report to the user has: the full MP4 path, the loudness table, the "please listen"
    line, the offer of a web page, and how to ask for changes by time.
