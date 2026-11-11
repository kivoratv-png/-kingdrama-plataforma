import { randomBytes, createHash, createHmac, timingSafeEqual, scrypt as derive, createCipheriv, createDecipheriv, hkdfSync } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt=promisify(derive),alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const randomToken=()=>randomBytes(32).toString('base64url');
export const consoleEncryptionKey=serverSecret=>Buffer.from(hkdfSync('sha256',Buffer.from(serverSecret),Buffer.from('kingdrama-console'),Buffer.from('totp-secret-v1'),32)).toString('base64url');
export function equal(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y);}
export async function passwordHash(password){const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});return `scrypt$${salt}$${key.toString('hex')}`;}
export async function passwordMatches(password,stored){const [kind,salt,key]=String(stored||'').split('$');if(kind!=='scrypt'||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{128}$/.test(key))return false;const actual=await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});return equal(actual.toString('hex'),key);}
export function newSecret(){let bits='',out='';for(const b of randomBytes(20))bits+=b.toString(2).padStart(8,'0');for(let i=0;i<bits.length;i+=5)out+=alphabet[parseInt(bits.slice(i,i+5),2)];return out;}
function secretBytes(secret){let bits='';for(const c of secret){const n=alphabet.indexOf(c);if(n<0)throw Error('Invalid secret');bits+=n.toString(2).padStart(5,'0');}return Buffer.from(Array.from({length:Math.floor(bits.length/8)},(_,i)=>parseInt(bits.slice(i*8,i*8+8),2)));}
export function totp(secret,counter,digits=6){const data=Buffer.alloc(8);data.writeBigUInt64BE(BigInt(counter));const mac=createHmac('sha1',secretBytes(secret)).update(data).digest();const offset=mac[19]&15;return String((mac.readUInt32BE(offset)&0x7fffffff)%10**digits).padStart(digits,'0');}
export function verifyTotp(secret,code,now=Date.now()){if(!/^\d{6}$/.test(code))return null;const step=Math.floor(now/30000);for(const counter of [step,step-1,step+1])if(equal(totp(secret,counter),code))return counter;return null;}
function encryptionKey(raw){const key=Buffer.from(raw||'','base64url');if(key.length!==32)throw Error('Encryption key unavailable');return key;}
export function encryptSecret(secret,rawKey){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(rawKey),iv);const data=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),data.toString('base64url')].join('.');}
export function decryptSecret(packed,rawKey){const [version,iv,tag,data]=packed.split('.');if(version!=='v1')throw Error('Invalid ciphertext');const cipher=createDecipheriv('aes-256-gcm',encryptionKey(rawKey),Buffer.from(iv,'base64url'));cipher.setAuthTag(Buffer.from(tag,'base64url'));return Buffer.concat([cipher.update(Buffer.from(data,'base64url')),cipher.final()]).toString('utf8');}
