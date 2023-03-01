// from: https://css-tricks.com/converting-color-spaces-in-javascript/#aa-hex-to-hsl

// keep in mind, normal hsl is not the same as three.js's hsl:
// normal:   https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/hsl
// three.js: https://threejs.org/docs/#api/en/math/Color.setHSL

export function hexToHSL(H) {
  // Convert hex to RGB first
  let r = 0, g = 0, b = 0;
  if (H.length == 4) {
    r = "0x" + H[1] + H[1];
    g = "0x" + H[2] + H[2];
    b = "0x" + H[3] + H[3];
  } else if (H.length == 7) {
    r = "0x" + H[1] + H[2];
    g = "0x" + H[3] + H[4];
    b = "0x" + H[5] + H[6];
  }
  // Then to HSL
  r /= 255;
  g /= 255;
  b /= 255;
  let cmin = Math.min(r,g,b);
  let cmax = Math.max(r,g,b);
  let delta = cmax - cmin;
  let h = 0;
  let s = 0;
  let l = 0;

  if (delta == 0)
    h = 0;
  else if (cmax == r)
    h = ((g - b) / delta) % 6;
  else if (cmax == g)
    h = (b - r) / delta + 2;
  else
    h = (r - g) / delta + 4;

  h = Math.round(h * 60);

  if (h < 0)
    h += 360;

  l = (cmax + cmin) / 2;
  s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  // s = +(s * 100).toFixed(1);
  // l = +(l * 100).toFixed(1);

  // from: https://stackoverflow.com/questions/54255536/three-js-sethsl-sets-unexpected-color
  h = h / 360;
  // s = s / 100;
  // l = l / 100;
  // console.log("hsl(" + h + "," + s + "%," + l + "%)");
  return [h, s, l];
  // return "hsl(" + h + "," + s + "%," + l + "%)";
}

// two-digit hex values; "percent" as in a decimal between 0 - 1

// const hexToPercent = (h) => {
export function hexToPercent(h) {
  h = '0x' + h;
  const int = parseInt(h, 16);
  return int / 255;
}

// from: https://gist.github.com/lopspower/03fb1cc0ac9f32ef38f4?permalink_comment_id=3036936#gistcomment-3036936
// const percentToHex = (p) => {
export function percentToHex(p) {
  const percent = Math.max(0, Math.min(100, p)); // bound percent from 0 to 100
  const intValue = Math.round(p / 100 * 255); // map percent to nearest integer (0 - 255)
  const hexValue = intValue.toString(16); // get hexadecimal representation
  return hexValue.padStart(2, '0').toUpperCase(); // format with leading 0 and upper case characters
}
