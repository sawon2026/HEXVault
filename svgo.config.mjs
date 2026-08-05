/** SVGO config for HEXVault brand assets */
export default {
  multipass: true,
  plugins: [
    {
      name: "preset-default",
      params: {
        overrides: {
          removeViewBox: false,
          removeTitle: false,
          removeDesc: false,
        },
      },
    },
  ],
};
