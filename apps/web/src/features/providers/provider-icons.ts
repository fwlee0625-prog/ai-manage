import anthropic from '../../assets/provider-icons/anthropic.svg?raw';
import deepseek from '../../assets/provider-icons/deepseek.svg?raw';
import kimi from '../../assets/provider-icons/kimi.svg?raw';
import minimax from '../../assets/provider-icons/minimax.svg?raw';
import openai from '../../assets/provider-icons/openai.svg?raw';
import openrouter from '../../assets/provider-icons/openrouter.svg?raw';
import zhipu from '../../assets/provider-icons/zhipu.svg?raw';

/** Inline brand SVGs keyed by `ProviderPreset.icon`; monochrome marks inherit the surrounding text color. */
const ICONS: Record<string, string> = { anthropic, deepseek, kimi, minimax, openai, openrouter, zhipu };

/** Returns the inline SVG markup for one preset icon key, or undefined when the preset has no brand. */
export function providerIconSvg(key?: string): string | undefined {
  return key ? ICONS[key] : undefined;
}
