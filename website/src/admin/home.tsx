import { Cards, CardsProps, Grid, Header, Link } from '@cloudscape-design/components';
import React from 'react';
import { AdminHomeCards, CardConfig } from '../components/homeCards';
import i18next from '../i18n';

/**
 * AdminHome component that displays the admin home page with navigation cards
 * @returns Rendered admin home page with cards grid
 */
const AdminHome = (): JSX.Element => {
  const cardDefinition: CardsProps.CardDefinition<CardConfig> = {
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
  };

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
          cardDefinition={cardDefinition}
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
