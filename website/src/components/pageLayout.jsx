import {
  BreadcrumbGroup,
  ContentLayout,
  Header,
  Link,
  SpaceBetween,
} from '@cloudscape-design/components';
import { useToolsOptionsDispatch } from '../store/appLayoutProvider';

export function PageLayout({ onLinkClick, ...props }) {
  const toolsOptionsDispatch = useToolsOptionsDispatch();

  const openHelpPanelHandler = () => {
    toolsOptionsDispatch({
      type: 'UPDATE',
      value: {
        isOpen: true,
      },
    });
  };

  if (props.simplified === true) {
    return (
      <>
        <BreadcrumbGroup items={props.breadcrumbs} ariaLabel="Breadcrumbs" />

        <Header variant="h1" description={props.description}>
          {props.header}
        </Header>
        {props.children}
      </>
    );
  } else {
    return (
      <ContentLayout
        header={
          <SpaceBetween size="m">
            <BreadcrumbGroup items={props.breadcrumbs} ariaLabel="Breadcrumbs" />
            {props.helpPanelHidden ? (
              <Header variant="h1" description={props.description}>
                {props.header}
              </Header>
            ) : (
              <Header
                variant="h1"
                info={
                  <Link variant="info" onFollow={openHelpPanelHandler}>
                    Info
                  </Link>
                }
                description={props.description}
              >
                {props.header}
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
