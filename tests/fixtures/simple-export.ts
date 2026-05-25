export function innerFunction() {
  return 'inner';
}

export function outerFunction() {
  return innerFunction() + ' outer';
}
