import {
  BreadcrumbGroup,
  BreadcrumbGroupProps,
  ContentLayout,
  Header,
  Link,
  SpaceBetween,
} from '@cloudscape-design/components';
import { useEffect } from 'react';
import { useStore } from '../store/store';

/**
 * Props for PageLayout component
 */
interface PageLayoutProps {
  onLinkClick?: (event: React.MouseEvent) => void;
  breadcrumbs: BreadcrumbGroupProps.Item[];
  description?: string;
  header: string;
  simplified?: boolean;
  helpPanelHidden?: boolean;
  helpPanelContent?: React.ReactNode;
  children?: React.ReactNode;
}

export function PageLayout({
  onLinkClick,
  breadcrumbs,
  description,
  header,
  simplified = false,
  helpPanelHidden = true,
  helpPanelContent = undefined,
  children,
}: PageLayoutProps) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  if (simplified === true) {
    return (
      <>
        <BreadcrumbGroup items={breadcrumbs} ariaLabel="Breadcrumbs" />

        <Header variant="h1" description={description}>
          {header}
        </Header>
        {children}
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
        {children}
      </ContentLayout>
    );
  }
}
