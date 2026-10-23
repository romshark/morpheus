// ZIP writer for the bundle builder, without a library. Files are deflated
// with CompressionStream, or stored when "deflate-raw" is unsupported.

export interface ZipFile {
	name: string;
	data: Uint8Array<ArrayBuffer>;
}

let crcTable: Uint32Array | undefined;

function crc32(data: Uint8Array): number {
	if (!crcTable) {
		crcTable = new Uint32Array(256);
		for (let n = 0; n < 256; n++) {
			let c = n;
			for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
			crcTable[n] = c;
		}
	}
	let crc = 0xffffffff;
	for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

async function deflateRaw(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer> | null> {
	let stream: CompressionStream;
	try {
		stream = new CompressionStream("deflate-raw");
	} catch {
		return null;
	}
	return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(stream)).arrayBuffer());
}

// zip returns an archive of files stamped with date,
// in local MS-DOS time (2-second resolution).
export async function zip(files: ZipFile[], date = new Date()): Promise<Blob> {
	const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
	const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
	const enc = new TextEncoder();
	const records: BlobPart[] = [];
	const directory: BlobPart[] = [];
	let offset = 0;
	let directorySize = 0;
	for (const file of files) {
		const name = enc.encode(file.name);
		const deflated = await deflateRaw(file.data);
		const body = deflated ?? file.data;
		const crc = crc32(file.data);
		// Writes the fields shared by the local header (from byte 4) and the
		// central directory entry (from byte 6). These are version needed,
		// flags, method, time, date, CRC-32, sizes and name length.
		const shared = (view: DataView, at: number) => {
			view.setUint16(at, 20, true);
			view.setUint16(at + 4, deflated ? 8 : 0, true);
			view.setUint16(at + 6, time, true);
			view.setUint16(at + 8, day, true);
			view.setUint32(at + 10, crc, true);
			view.setUint32(at + 14, body.length, true);
			view.setUint32(at + 18, file.data.length, true);
			view.setUint16(at + 22, name.length, true);
		};
		const header = new DataView(new ArrayBuffer(30));
		header.setUint32(0, 0x04034b50, true);
		shared(header, 4);
		records.push(header, name, body);

		const entry = new DataView(new ArrayBuffer(46));
		entry.setUint32(0, 0x02014b50, true);
		entry.setUint16(4, 20, true); // version made by
		shared(entry, 6);
		entry.setUint32(42, offset, true);
		directory.push(entry, name);

		offset += header.byteLength + name.length + body.length;
		directorySize += entry.byteLength + name.length;
	}
	const end = new DataView(new ArrayBuffer(22));
	end.setUint32(0, 0x06054b50, true);
	end.setUint16(8, files.length, true);
	end.setUint16(10, files.length, true);
	end.setUint32(12, directorySize, true);
	end.setUint32(16, offset, true);
	return new Blob([...records, ...directory, end], { type: "application/zip" });
}
