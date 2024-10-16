const { parseEnvVars } = require("./hasura");

describe("parseEnvVars()", () => {
  it("should parse single environment variable correctly", () => {
    const rawEnvVars = "KEY=value";
    const expected = [{ key: "KEY", value: "value" }];
    expect(parseEnvVars(rawEnvVars)).toEqual(expected);
  });

  it("should parse numeric environment variables correctly", () => {
    const rawEnvVars = "KEY=1";
    const expected = [{ key: "KEY", value: "1" }];
    expect(parseEnvVars(rawEnvVars)).toEqual(expected);
  });

  it("should parse environment variables and keep the quotes", () => {
    const rawEnvVars = 'KEY="value"';
    const expected = [{ key: "KEY", value: '"value"' }];
    expect(parseEnvVars(rawEnvVars)).toEqual(expected);
  });

  it("should stringify json environment variables", () => {
    const rawEnvVars = 'KEY={"foo":"bar", "baz": 1}';
    const expected = [{ key: "KEY", value: '{"foo":"bar", "baz": 1}' }];
    expect(parseEnvVars(rawEnvVars)).toEqual(expected);
  });

  it("should parse multiple environment variables correctly", () => {
    const rawEnvVars = "KEY1=value1\nKEY2=value2";
    const expected = [
      { key: "KEY1", value: "value1" },
      { key: "KEY2", value: "value2" },
    ];
    expect(parseEnvVars(rawEnvVars)).toEqual(expected);
  });

  it("should handle environment variables with semicolons", () => {
    const rawEnvVars = "KEY1=value1;comment\nKEY2=value2";
    const expected = [
      { key: "KEY1", value: "value1" },
      { key: "KEY2", value: "value2" },
    ];
    expect(parseEnvVars(rawEnvVars)).toEqual(expected);
  });

  it("should handle environment variables with equal signs in value", () => {
    const rawEnvVars = "KEY1=value1=extra\nKEY2=value2";
    const expected = [
      { key: "KEY1", value: "value1=extra" },
      { key: "KEY2", value: "value2" },
    ];
    expect(parseEnvVars(rawEnvVars)).toEqual(expected);
  });

  it("should ignore empty lines", () => {
    const rawEnvVars = "KEY1=value1\n\nKEY2=value2";
    const expected = [
      { key: "KEY1", value: "value1" },
      { key: "KEY2", value: "value2" },
    ];
    expect(parseEnvVars(rawEnvVars)).toEqual(expected);
  });

  it("should return an empty array for empty input", () => {
    const rawEnvVars = "";
    const expected = [];
    expect(parseEnvVars(rawEnvVars)).toEqual(expected);
  });

  it("should handle environment variables without values", () => {
    const rawEnvVars = "KEY1=\nKEY2=value2";
    const expected = [
      { key: "KEY1", value: "" },
      { key: "KEY2", value: "value2" },
    ];
    expect(parseEnvVars(rawEnvVars)).toEqual(expected);
  });
});
