// this will load all the patterns in patterns.json and generate general midi files for them

import { readFile, writeFile } from 'node:fs/promises'
import Midi from 'jsmidgen'

const patterns = JSON.parse(await readFile('docs/patterns.json'))

// map letters in book to General MIDI notes
// https://www.zendrum.com/resource-site/drumnotes.htm
// intruments with ? need to be checked on
const instruments = {
  BD: 36, // Bass Drum 1
  SN: 38, // Acoustic Snare
  CY: 51, // Ride Cymbal 1
  CH: 42, // Closed Hi-Hat
  CB: 56, // Cowbell
  CL: 39, // Hand Clap
  LT: 45, // Low Tom
  MT: 47, // Low-Mid Tom
  HT: 50, // High Tom
  OH: 46, // Open Hi-Hat
  SH: 70, // Maracas?
  RS: 53, // Ride Bell?
  AC: 69 // Cabasa?
}

// utput a safe filename for a string
const safeId = str => String(str).replace(/[^a-z0-9\-_]/gi, '_').toLowerCase()

// take a pattermn & turn it into MIDI
function patternTMidi (pattern) {
  const file = new Midi.File()
  const tracks = {}
  for (const i of Object.keys(pattern)) {
    tracks[i] = new Midi.Track()
    file.addTrack(tracks[i])
  }

  for (let n = 0; n < 16; n++) {
    for (const i of Object.keys(pattern)) {
      // handle "Rolls"
      if (i.endsWith('R')) {
        if (instruments[i] && pattern[i]?.includes(n + 1)) {
          tracks[i].addNote(9, instruments[i], 16)
          tracks[i].addNote(9, instruments[i], 16)
          tracks[i].addNote(9, instruments[i], 16)
          tracks[i].addNote(9, instruments[i], 16)
        } else {
          tracks[i].addNote(9, 0, 64)
        }
      } else {
        if (instruments[i] && pattern[i]?.includes(n + 1)) {
          tracks[i].addNote(9, instruments[i], 64)
        } else {
          tracks[i].addNote(9, 0, 64)
        }
      }
    }
  }

  return file.toBytes()
}

const info = {}
for (const t of Object.keys(patterns)) {
  info[t] = {}
  for (const i of Object.keys(patterns[t])) {
    info[t][i] = `${safeId(t)}-${safeId(i)}`
    await writeFile(`docs/mid/${info[t][i]}.mid`, patternTMidi(patterns[t][i]), 'binary')
  }
}

console.log(JSON.stringify(info, null, 2))
