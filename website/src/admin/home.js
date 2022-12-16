import { Cards, Grid, Header, Link } from '@cloudscape-design/components';
import React from 'react';

export function AdminHome() {
  return (
    <Grid gridDefinition={[{ colspan: 1 }, { colspan: 10 }, { colspan: 1 }]}>
      <div></div>
      <Cards
        ariaLabels={{
          itemSelectionLabel: (e, t) => `select ${t.name}`,
          selectionGroupLabel: 'Item selection',
        }}
        cardDefinition={{
          header: (item) => (
            <Link fontSize="heading-m" href={item.link}>
              {item.name}
            </Link>
          ),
          sections: [
            {
              id: 'description',
              header: 'Description',
              content: (item) => item.description,
            },
          ],
        }}
        cardsPerRow={[{ cards: 1 }, { minWidth: 500, cards: 2 }]}
        items={[
          {
            name: 'All models',
            link: '/admin/models',
            description: 'List of the models uploaded by users',
          },
          {
            name: 'Quarantined models',
            link: '/admin/quarantine',
            description: 'Any models that have been flagged as suspicious during upload',
          },
          {
            name: 'Cars',
            link: '/admin/cars',
            description: 'List of all of the online cars',
          },
          {
            name: 'Car activiation',
            link: '/admin/car_activation',
            description: 'Create the commands to add a car to DREM',
          },
          {
            name: 'Groups',
            link: '/admin/groups',
            description: 'Add / remove people from user groups',
          },
        ]}
        header={<Header>DREM Admin</Header>}
      />
      <div></div>
    </Grid>
  );
}
