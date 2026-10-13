export const MAX_CSV_FILE_BYTES = 8 * 1024 * 1024

/** Read CSV locally without losing Telugu text or Excel Unicode encodings. */
export async function readCsvFile(file: Pick<File, 'name' | 'size' | 'arrayBuffer'>): Promise<string> {
  if (!/\.csv$/i.test(file.name)) throw new Error('Choose a .csv file. Save Excel workbooks as CSV first.')
  if (file.size > MAX_CSV_FILE_BYTES) throw new Error('CSV files must be 8 MB or smaller.')
  if (file.size === 0) throw new Error('This CSV file is empty.')
  let buffer: ArrayBuffer
  try { buffer = await file.arrayBuffer() } catch { throw new Error('Could not read this file. Please choose it again.') }
  const bytes = new Uint8Array(buffer)
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le'
    : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8'
  let text: string
  try { text = new TextDecoder(encoding, { fatal: true }).decode(bytes) }
  catch { throw new Error('Could not read the text encoding. Save the file as CSV UTF-8 and try again.') }
  if (text.includes('\u0000')) throw new Error('This file is not a text CSV. Save it as CSV UTF-8 and try again.')
  if (!text.trim()) throw new Error('This CSV file has no content.')
  return text
}
