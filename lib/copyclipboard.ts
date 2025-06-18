export const copyTableToClipboard = async (tableData: HTMLTableElement) => {
  const rows = Array.from(tableData.rows)
  const text = rows.map((row) => {
    const cells = Array.from(row.cells)
    return cells.map(cell => cell.textContent || '').join('\t')
  }).join('\n')
  await navigator.clipboard.writeText(text)
  return true
}

export const copyUrlToClipboard = async (url: string) => {
  await navigator.clipboard.writeText(url)
  return true
}   

export const copyTextToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
}

export const copyImageToClipboard = (image: string) => {
  navigator.clipboard.writeText(image)
}

export const copyHtmlToClipboard = (html: string) => {
  navigator.clipboard.writeText(html)
}

export const copyJsonToClipboard = (json: string) => {
  navigator.clipboard.writeText(json)
}

export const copyCsvToClipboard = (csv: string) => {
  navigator.clipboard.writeText(csv)
}