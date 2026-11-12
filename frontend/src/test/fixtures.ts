import type { Estado } from '../types/api';
const examples = import.meta.glob('../../../docs/fixtures/*.json', { eager: true, import: 'default' });
export function fixture(name: string): Estado { return structuredClone(examples[`../../../docs/fixtures/${name}.json`]) as Estado; }
