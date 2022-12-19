import { Cards, Grid, Header, Link } from '@cloudscape-design/components';
import { AdminHomeCards } from '../components/HomeCards';

import React from 'react';

const AdminHome = () => {
  return (
    <>
      <img
        src="/logo-bw.png"
        alt="Logo"
        width={300}
        height={300}
        className="center awsui-util-hide-in-dark-mode"
      />
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
          items={AdminHomeCards()}
          header={<Header>DeepRacer Event Manager Admin</Header>}
        />
        <div></div>
      </Grid>
    </>
  );
};

export { AdminHome };
