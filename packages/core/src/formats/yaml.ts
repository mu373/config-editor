import yaml from 'js-yaml';

export function yamlToJson(yamlContent: string): unknown {
  return yaml.load(yamlContent);
}

export function jsonToYaml(jsonContent: unknown): string {
  return yaml.dump(jsonContent, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });
}

export function parseYaml(content: string): unknown {
  return yaml.load(content);
}

export function stringifyYaml(value: unknown): string {
  return yaml.dump(value, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });
}
