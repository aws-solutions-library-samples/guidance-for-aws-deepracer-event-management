import {
  BreadcrumbGroup,
  ContentLayout,
  Header,
  Link,
  SpaceBetween,
} from '@cloudscape-design/components';
import { useEffect } from 'react';
import { useStore } from '../store/store';

export function PageLayout({
  onLinkClick,
  breadcrumbs,
  description,
  header,
  simplified = false,
  helpPanelHidden = true,
  helpPanelContent = undefined,
  ...props
}) {
  const [, dispatch] = useStore();

  // Help panel
  useEffect(() => {
    dispatch('UPDATE_HELP_PANEL', {
      isHidden: helpPanelHidden,
      content: helpPanelContent,
    });

    return () => {
      dispatch('RESET_HELP_PANEL');
    };
  }, [dispatch]);

  if (simplified === true) {
    return (
      <>
        <BreadcrumbGroup items={breadcrumbs} ariaLabel="Breadcrumbs" />

        <Header variant="h1" description={description}>
          {header}
        </Header>
        {props.children}
      </>
    );
  } else {
    return (
      <ContentLayout
        header={
          <SpaceBetween size="m">
            <BreadcrumbGroup items={breadcrumbs} ariaLabel="Breadcrumbs" />
            {helpPanelHidden ? (
              <Header variant="h1" description={description}>
                {header}
              </Header>
            ) : (
              <Header
                variant="h1"
                info={
                  <Link variant="info" onFollow={() => dispatch('HELP_PANEL_IS_OPEN', true)}>
                    Info
                  </Link>
                }
                description={description}
              >
                {header}
              </Header>
            )}
          </SpaceBetween>
        }
      >
        {props.children}
      </ContentLayout>
    );
  }
}
