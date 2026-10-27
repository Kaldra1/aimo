import type { APIRoute, GetStaticPaths } from 'astro';
import { loadContent } from '../../../lib/content/collections';
import { REPORT_SESSIONS, reportSource } from '../../../lib/report/source';
import { VARIANTS } from '../../../lib/variants/variants';

export const getStaticPaths = (async () => {
  const { sessions } = await loadContent();
  return [...REPORT_SESSIONS].flatMap((id) => {
    const session = sessions.find((s) => s.id === id);
    if (!session) throw new Error(`Звіт «${id}»: заняття з таким файлом не знайдено`);
    return Array.from({ length: VARIANTS }, (_, i) => ({
      params: { session: id, n: String(i + 1) },
      props: {
        source: reportSource(
          {
            id,
            kind: session.data.kind,
            number: session.data.number,
            title: session.data.title,
          },
          i + 1,
        ),
      },
    }));
  });
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(props.source), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
