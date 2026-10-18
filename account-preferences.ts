export function accountPreferences(cloud:Record<string,unknown>,entry:Record<string,unknown>,explicit:Record<string,unknown>) {
  const language=explicit.language ? entry.language : cloud.language ?? entry.language;
  const theme=explicit.theme ? entry.theme : cloud.theme ?? entry.theme;
  return {
    language:language==='kn'||language==='hi'?language:'en',
    theme:theme==='dark'?'dark':'light',
  } as const;
}
