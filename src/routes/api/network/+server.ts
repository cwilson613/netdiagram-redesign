import { json } from '@sveltejs/kit';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { RequestHandler } from './$types';

// Disable prerendering for this API route
export const prerender = false;

export const GET: RequestHandler = async () => {
	// Try mounted volume first, then fallback to built-in static file
	const paths = [
		'/data/network.json',
		'./build/client/data/network.json',
		'./static/data/network.json'
	];

	for (const filePath of paths) {
		try {
			if (existsSync(filePath)) {
				const fileContent = await readFile(filePath, 'utf-8');
				const networkData = JSON.parse(fileContent);
				console.log(`Successfully loaded network data from ${filePath}`);
				return json(networkData);
			}
		} catch (error) {
			console.error(`Error reading from ${filePath}:`, error);
		}
	}

	// If no file found, return empty structure
	console.warn('Network data file not found in any location, returning empty structure');
	return json({
		machines: [],
		devices: []
	});
};
