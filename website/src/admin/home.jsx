import { Cards, Grid, Header, Link } from '@cloudscape-design/components';
import React from 'react';
import { AdminHomeCards } from '../components/homeCards';
import i18next from '../i18n';

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
                content: (item) => item.description,
              },
            ],
          }}
          cardsPerRow={[{ cards: 1 }, { minWidth: 500, cards: 2 }]}
          items={AdminHomeCards()}
          header={<Header>{i18next.t('admin.home-header')}</Header>}
        />
        <div></div>
      </Grid>
    </>
  );
};

export { AdminHome };
