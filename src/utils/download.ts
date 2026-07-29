export function downloadFile(url: string, filename: string) {
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)

  downloadFile(url, filename)
  URL.revokeObjectURL(url)
}
