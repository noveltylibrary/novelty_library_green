/** LexiWord answer pool: real five-letter words with a bookish flavour. Any five-letter word is accepted as a guess. */
export const LEXI_WORDS: string[] = `
novel prose verse plots scene theme tales epics fable myths sagas quill paper pages spine cover index genre irony tones voice
story rhyme meter drama magic quest crime clues alibi motif shelf books reads words write wrote inked lines title error dream
ghost witch elves giant crown sword royal noble knave bards poems lyric canto idyll epoch fates grief heart lover pride wrath
honor truth light shade night storm ocean river folio plate print edits proof draft blurb abbey manor tower mazes codex runes
actor stage comic witty brave world prize
`.trim().split(/\s+/).map((w) => w.toUpperCase()).filter((w) => /^[A-Z]{5}$/.test(w));
