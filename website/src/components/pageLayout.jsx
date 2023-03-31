import { BreadcrumbGroup, ContentLayout, Header, SpaceBetween } from '@cloudscape-design/components';

export function PageLayout(props) {
    if (props.simplified === true)
    {
        return (
            <>
                <BreadcrumbGroup items={props.breadcrumbs} ariaLabel="Breadcrumbs" />

                <Header variant="h1" description={props.description}>
                    {props.header}
                </Header>
                {props.children}
            </>
        )
    }
    else
    {
        return (
            <ContentLayout
                header={
                    <SpaceBetween size="m">
                    <BreadcrumbGroup items={props.breadcrumbs} ariaLabel="Breadcrumbs" />
                    <Header
                        variant="h1"
                        // info={<Link>Info</Link>}
                        description={props.description}
                    >
                        {props.header}
                    </Header>
                    </SpaceBetween>
                }
                >
                {props.children}
            </ContentLayout>
        )
    }
}