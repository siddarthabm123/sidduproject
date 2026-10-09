import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import jsQR from 'jsqr';
import { verifyBondToken } from '../bond-signature';

// The image loader is supplied by the local QA runtime, not shipped to browsers.
const modules=process.env.RIGDESK_QA_IMAGE_MODULES;
if(!modules)throw new Error('Set RIGDESK_QA_IMAGE_MODULES to a runtime containing sharp.');
const sharp=createRequire(resolve(modules,'../package.json'))('sharp');
const {data,info}=await sharp(resolve('tmp/pdfs/rigdesk-bond-qa.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const decoded=jsQR(new Uint8ClampedArray(data),info.width,info.height);
assert.ok(decoded,'The QR in the rendered one-page PDF must be readable.');
const url=new URL(decoded.data);
assert.equal(url.pathname,'/verify/RD-QR-QA-20261009');
process.env.BOND_PDF_SECRET='test-only-key-not-for-production';
const record=verifyBondToken(url.searchParams.get('token')||'');
assert.equal(record?.bookingId,'RD-QR-QA-20261009');
assert.equal(record?.mode,'demo');
assert.equal(record?.totalAmount,74520);
console.log('Rendered PDF QR decoded and its signed reference and totals match.');
