import 'dotenv/config';

const base = require('./app.json');

export default () => ({
  expo: {
    ...base.expo,
    extra: {
      ...(base.expo?.extra ?? {}),
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    },
  },
});


