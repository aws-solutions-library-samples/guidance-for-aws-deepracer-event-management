import { Cards, Grid, Header, Link } from '@cloudscape-design/components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { HomeCards } from './components/homeCards';

const Home = () => {
  const { t } = useTranslation();

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
          items={HomeCards()}
          header={<Header>{t('home.header', 'DeepRacer Event Manager')}</Header>}
        />
        <div></div>
      </Grid>
    </>
  );
};

export { Home };
