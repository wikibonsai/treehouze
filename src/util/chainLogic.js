// from: https://github.com/sms-system/conditional-chain
// via: https://stackoverflow.com/a/52399890
export default function cond (chain) {
  return {
    if (condition, thenF, elseF) {
      return cond(condition ? thenF(chain) : (
        elseF ? elseF(chain) : chain
      ));
    },
    chain (f) {
      return cond(f(chain));
    },
    end () {
      return chain;
    }
  };
}
