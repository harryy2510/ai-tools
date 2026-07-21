export function utf8ToBytes(text: string): Uint8Array {
	return new TextEncoder().encode(text)
}

export function bytesToUtf8(bytes: Uint8Array): string {
	return new TextDecoder().decode(bytes)
}

export function bytesToBase64(bytes: Uint8Array): string {
	let binary = ''
	for (let i = 0; i < bytes.length; i += 1) {
		binary += String.fromCharCode(bytes[i] ?? 0)
	}
	return btoa(binary)
}

export function base64ToBytes(base64: string): Uint8Array {
	const binary = atob(base64)
	const out = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i += 1) {
		out[i] = binary.charCodeAt(i)
	}
	return out
}
