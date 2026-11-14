import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { equipmentPhotoSource, demoPhotoCredits } from '../EquipmentPhoto';
import { rentalEndDate } from '../RentalDatePresets';

test('equipment photo fallback preserves supplied photos and stops after both raster sources fail',()=>{
 const supplied='https://images.example.test/actual-owner-equipment.jpg';
 assert.equal(equipmentPhotoSource(supplied,'Excavator'),supplied);
 assert.equal(equipmentPhotoSource(supplied,'Excavator',[supplied]),'/assets/heavy-excavator.jpg');
 assert.equal(equipmentPhotoSource(supplied,'Excavator',[supplied,'/assets/heavy-excavator.jpg']),null);
 assert.equal(equipmentPhotoSource('/diagram.svg','Excavator'),'/assets/heavy-excavator.jpg');
 assert.equal(equipmentPhotoSource('data:image/svg+xml;base64,anything','Unknown'),null);
 assert.equal(equipmentPhotoSource(undefined,'Unknown'),null);
});

test('demo equipment photos are distinct local raster assets and added photos retain attribution',()=>{
 const source=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
 const seed=source.slice(source.indexOf('const machinerySeed:'),source.indexOf('const vehicleCoordinates:'));
 const names=[...seed.matchAll(/image:AS\+'([^']+)'/g)].map(m=>m[1]);
 assert.equal(names.length,11);assert.equal(new Set(names).size,names.length);
 const hashes=new Set<string>();
 for(const name of names){const path=new URL(`../public/assets/${name}`,import.meta.url);assert.ok(existsSync(path));const bytes=readFileSync(path);assert.equal(bytes.subarray(0,2).toString('hex'),'ffd8');hashes.add(createHash('sha256').update(bytes).digest('hex'))}
 assert.equal(hashes.size,names.length);
 for(const [path,credit] of Object.entries(demoPhotoCredits)){assert.ok(existsSync(new URL('../public'+path,import.meta.url)));assert.match(credit.source,/commons\.wikimedia\.org\/wiki\/File:/);assert.match(credit.license,/creativecommons\.org\/licenses\/by-sa\//)}
});

test('duration presets change inclusive availability dates across months and leap years, not rates',()=>{
 assert.equal(rentalEndDate('2026-11-15',1),'2026-11-15');
 assert.equal(rentalEndDate('2026-12-29',7),'2027-01-04');
 assert.equal(rentalEndDate('2028-02-01',30),'2028-03-01');
 assert.equal(rentalEndDate('2026-02-30',7),null);assert.equal(rentalEndDate('',7),null);
});
