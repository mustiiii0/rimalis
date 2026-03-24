/* eslint-disable no-console */
const crypto = require('node:crypto');

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:8080';

function fail(message, details) {
  console.error(`SMOKE FAIL: ${message}`);
  if (details) console.error(details);
  process.exit(1);
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body,
  });

  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function expectStatus(response, body, expected, label) {
  if (response.status !== expected) {
    fail(`${label} expected ${expected} but got ${response.status}`, body);
  }
}

async function main() {
  const email = `smoke_${Date.now()}_${crypto.randomInt(1000, 9999)}@example.com`;
  const password = 'Admin1234';
  const name = 'Smoke User';

  console.log(`Running smoke tests against ${BASE_URL}`);

  const health = await request('/health');
  expectStatus(health.response, health.body, 200, 'health');
  if (health.body?.status !== 'ok') fail('health response missing status=ok', health.body);

  const apiRoot = await request('/api');
  expectStatus(apiRoot.response, apiRoot.body, 200, 'api root');

  const register = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify({ name, email, password }),
  });
  expectStatus(register.response, register.body, 201, 'register');

  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify({ email, password }),
  });
  expectStatus(login.response, login.body, 200, 'login');
  const accessToken = login.body?.accessToken;
  if (!accessToken) fail('login response missing accessToken', login.body);

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6lD+UAAAAASUVORK5CYII=',
    'base64'
  );
  const formData = new FormData();
  formData.append('image', new Blob([png], { type: 'image/png' }), 'smoke.png');

  const upload = await request('/api/uploads/image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'X-Requested-With': 'XMLHttpRequest' },
    body: formData,
  });
  expectStatus(upload.response, upload.body, 201, 'image upload');
  if (!upload.body?.imageUrl) fail('upload response missing imageUrl', upload.body);

  const createListing = await request('/api/users/me/listings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({
      title: 'Smoke Listing',
      location: 'Stockholm',
      price: 1234567,
      propertyType: 'Villa',
      livingArea: 120,
      rooms: 5,
      address: 'Testvägen 1',
      description: 'Detta är en smoke-test annons för att verifiera hela listing-flödet.',
      imageUrl: upload.body.imageUrl,
    }),
  });
  expectStatus(createListing.response, createListing.body, 201, 'create listing');
  const listingId = createListing.body?.listing?.id;
  if (!listingId) fail('create listing response missing listing.id', createListing.body);

  const myListings = await request('/api/users/me/listings', {
    headers: { Authorization: `Bearer ${accessToken}`, 'X-Requested-With': 'XMLHttpRequest' },
  });
  expectStatus(myListings.response, myListings.body, 200, 'my listings');
  if (!Array.isArray(myListings.body?.listings)) fail('my listings response invalid', myListings.body);

  const propertyById = await request(`/api/properties/${encodeURIComponent(listingId)}`);
  expectStatus(propertyById.response, propertyById.body, 200, 'property details');

  const publicListings = await request('/api/properties/public');
  expectStatus(publicListings.response, publicListings.body, 200, 'public listings');
  if (!Array.isArray(publicListings.body?.properties)) fail('public listings response invalid', publicListings.body);

  const deleteListing = await request(`/api/users/me/listings/${encodeURIComponent(listingId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}`, 'X-Requested-With': 'XMLHttpRequest' },
  });
  expectStatus(deleteListing.response, deleteListing.body, 200, 'delete listing');

  const propertyAfterDelete = await request(`/api/properties/${encodeURIComponent(listingId)}`);
  expectStatus(propertyAfterDelete.response, propertyAfterDelete.body, 404, 'property after delete');

  console.log('SMOKE OK: core flows passed');
}

main().catch((err) => fail('Unhandled smoke error', err.stack || err.message));
