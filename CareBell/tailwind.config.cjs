module.exports = {
  darkMode: 'class',
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {},
  },
  plugins: [
    function ({ addVariant }) {
      addVariant('portrait', '@media (orientation: portrait)');
      addVariant('landscape', '@media (orientation: landscape)');
    },
  ],
};
