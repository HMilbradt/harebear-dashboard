import { Heading, IconImage, List, Row, Stack, Text, type ViewProps } from "@/sdk"
import type plugin from "./server"

export default function BookmarksView({ data }: ViewProps<typeof plugin>) {
  return (
    <Stack gap="lg">
      {data.map((group, i) => (
        <Stack key={i} gap="sm">
          {group.title && <Heading level={4}>{group.title}</Heading>}
          <List gap="xs">
            {group.links.map((l) => (
              <a
                key={l.url}
                href={l.url}
                target={l.newTab ? "_blank" : undefined}
                rel={l.newTab ? "noreferrer" : undefined}
                className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 outline-none hover:bg-muted focus-visible:bg-muted"
              >
                <IconImage icon={l.icon} fallback={l.title} size="sm" />
                <Row gap="sm" justify="between">
                  <Text weight="medium" truncate>
                    {l.title}
                  </Text>
                  {l.description && (
                    <Text size="xs" tone="muted" truncate>
                      {l.description}
                    </Text>
                  )}
                </Row>
              </a>
            ))}
          </List>
        </Stack>
      ))}
    </Stack>
  )
}
