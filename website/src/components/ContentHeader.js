import {
  BreadcrumbGroup,
  Grid,
  Header
} from "@cloudscape-design/components";

export function ContentHeader(props) {

  return (
    <>
      <Grid gridDefinition={[{ colspan: 2 }, { colspan: 8 }, { colspan: 2 }]}>
        <div></div>
        <BreadcrumbGroup
          items={props.breadcrumbs}
          ariaLabel="Breadcrumbs"
        />
      </Grid>
      <Grid gridDefinition={[{ colspan: 2 }, { colspan: 8 }, { colspan: 2 }]}>
        <div></div>
        <Header
          variant="h1"
          description={props.description}
        >
          {props.header}
        </Header>
      </Grid>
    </>
  )
}
