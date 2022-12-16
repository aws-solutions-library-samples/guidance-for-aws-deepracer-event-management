import { BreadcrumbGroup, Grid, Header } from '@cloudscape-design/components';
import React from 'react';

export function ContentHeader(props) {
  return (
    <>
      <Grid gridDefinition={[{ colspan: 1 }, { colspan: 10 }, { colspan: 1 }]}>
        <div></div>
        <BreadcrumbGroup items={props.breadcrumbs} ariaLabel="Breadcrumbs" />
      </Grid>
      <Grid gridDefinition={[{ colspan: 1 }, { colspan: 10 }, { colspan: 1 }]}>
        <div></div>
        <Header variant="h1" description={props.description}>
          {props.header}
        </Header>
      </Grid>
    </>
  );
}
