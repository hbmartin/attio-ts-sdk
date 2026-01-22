import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: 'https://api.attio.com/openapi/api', // sign up at app.heyapi.dev
  output: 'src/generated',
  plugins: [
    '@hey-api/typescript', 
    'zod',
    {
      name: '@hey-api/sdk', 
      validator: true, 
    },
  ],
});
