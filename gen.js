// this will load all the patterns in patterns.json and generate general midi files for them

import { readFile, writeFile } from 'node:fs/promises'
import Midi from 'jsmidgen'

const patterns = JSON.parse(await readFile('docs/patterns.json'))

// map letters in book to General MIDI notes
// https://www.zendrum.com/resource-site/drumnotes.htm
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

  // these should be double-checked
  SH: 70, // Maracas?
  RS: 53, // Ride Bell?
  AC: 69 // Cabasa?
}

// utput a safe filename for a string
const safeId = str => String(str).replace(/[^a-z0-9\-_]/gi, '_').toLowerCase()

// take a pattermn & turn it into MIDI
function patternToMidi (pattern) {
  const file = new Midi.File()
  const tracks = {}
  for (const i of Object.keys(pattern)) {
    tracks[i] = new Midi.Track()
    file.addTrack(tracks[i])
    tracks[i].setTempo(120)
  }

  for (let n = 0; n < 16; n++) {
    for (const i of Object.keys(pattern)) {
      // handle "Rolls"
      if (i.endsWith('R')) {
        const r = i.replace(/R$/, '')
        if (pattern[i]?.includes(n + 1)) {
          tracks[i].addNote(9, Midi.Util.noteFromMidiPitch(instruments[r]), 16)
          tracks[i].addNote(9, Midi.Util.noteFromMidiPitch(instruments[r]), 16)
          tracks[i].addNote(9, Midi.Util.noteFromMidiPitch(instruments[r]), 16)
        } else {
          tracks[i].addNoteOff(9, Midi.Util.noteFromMidiPitch(instruments[i]), 64)
        }
      } else {
        if (instruments[i] && pattern[i]?.includes(n + 1)) {
          tracks[i].addNote(9, instruments[i], 64)
        } else {
          tracks[i].addNoteOff(9, Midi.Util.noteFromMidiPitch(instruments[i]), 64)
        }
      }
    }
  }

  return file.toBytes()
}

for (const t of Object.keys(patterns)) {
  for (const i of Object.keys(patterns[t])) {
    const f = `${safeId(t)}-${safeId(i)}`
    await writeFile(`mid/${f}.mid`, patternToMidi(patterns[t][i]), 'binary')
  }
}

// let sel = '<select id="beat">\n'
// for (const t of Object.keys(patterns)) {
//   sel += `  <optgroup label=${JSON.stringify(t)}>\n`
//   for (const i of Object.keys(patterns[t])) {
//     const f = `${safeId(t)}-${safeId(i)}`
//     sel += `    <option value=${JSON.stringify(f)}>${i}</option>\n`
//   }
//   sel += '  </optgroup>\n'
// }
// sel += '</select>'

// console.log(sel)
