describe('Ejemplo unit test', () => {
  test('suma básica', () => {
    expect(2 + 2).toBe(4)
  })

  test('string check', () => {
    expect('appium').toContain('app')
  })
})