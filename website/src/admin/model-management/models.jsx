import { API } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { PageLayout } from '../../components/pageLayout';
import * as queries from '../../graphql/queries';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useToolsOptionsDispatch } from '../../store/appLayoutProvider';

// import * as mutations from '../graphql/mutations';
// import * as subscriptions from '../graphql/subscriptions'

import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Button,
  Header,
  Pagination,
  PropertyFilter,
  SpaceBetween,
  Table,
} from '@cloudscape-design/components';
import { formatAwsDateTime } from '../../support-functions/time';

import { useTranslation } from 'react-i18next';
import {
  PropertyFilterI18nStrings,
  TableEmptyState,
  TableNoMatchState,
} from '../../components/tableCommon';
import {
  AdminModelsColumnsConfig,
  DefaultPreferences,
  MatchesCountText,
  TablePreferences,
} from '../../components/tableConfig';
import CarModelUploadModal from './carModelUploadModal';

const AdminModels = () => {
  const { t } = useTranslation();

  const [allModels, setAllModels] = useState([]);
  const [cars, setCars] = useState([]);
  const [modelsIsLoading, setModelsIsLoading] = useState(true);
  const [carsIsLoading, setCarsIsLoading] = useState(true);
  const [selectedModelsBtn, setSelectedModelsBtn] = useState(true);
  const toolsOptionsDispatch = useToolsOptionsDispatch();

  async function getCarsOnline() {
    setCarsIsLoading(true);
    console.log('Collecting cars...');
    // Get CarsOnline
    const response = await API.graphql({
      query: queries.carsOnline,
      variables: { online: true },
    });
    setCars(response.data.carsOnline);
    setCarsIsLoading(false);
  }
  async function getModels() {
    setModelsIsLoading(true);
    console.log('Collecting models...');
    const response = await API.graphql({
      query: queries.getAllModels,
    });
    console.log(response);
    const models_response = response.data.getAllModels;
    const models = models_response.map(function (model, i) {
      const modelKeyPieces = model.modelKey.split('/');
      return {
        key: model.modelKey,
        userName: modelKeyPieces[modelKeyPieces.length - 3],
        modelName: modelKeyPieces[modelKeyPieces.length - 1],
        modelDate: formatAwsDateTime(model.uploadedDateTime),
        ...model,
      };
    });
    setAllModels(models);
    setModelsIsLoading(false);
  }

  useEffect(() => {
    getModels();
    getCarsOnline();

    return () => {
      // Unmounting
    };
  }, []);

  // Help panel
  const helpPanelHidden = true;
  useEffect(() => {
    toolsOptionsDispatch({
      type: 'UPDATE',
      value: {
        //isOpen: true,
        isHidden: helpPanelHidden,
        // content: (
        //   <SimpleHelpPanelLayout
        //     headerContent={t('header', { ns: 'help-admin-models' })}
        //     bodyContent={t('content', { ns: 'help-admin-models' })}
        //     footerContent={t('footer', { ns: 'help-admin-models' })}
        //   />
        // ),
      },
    });

    return () => {
      toolsOptionsDispatch({ type: 'RESET' });
    };
  }, [toolsOptionsDispatch]);

  const [preferences, setPreferences] = useLocalStorage('DREM-models-table-preferences', {
    ...DefaultPreferences,
    visibleContent: ['userName', 'modelName', 'modelDate'],
  });

  const adminModelsColsConfig = AdminModelsColumnsConfig();

  const filteringProperties = [
    {
      key: 'userName',
      propertyLabel: t('models.user-name'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'modelName',
      propertyLabel: t('models.model-name'),
      operators: [':', '!:', '=', '!='],
    },
    // {
    //   key: 'modelDate',
    //   propertyLabel: t('models.upload-date'),
    //   groupValuesLabel: 'Created at value',
    //   defaultOperator: '>',
    //   operators: ['<', '<=', '>', '>='].map((operator) => ({
    //     operator,
    //     form: ({ value, onChange }) => (
    //       <div className="date-form">
    //         {' '}
    //         <FormField>
    //           {' '}
    //           <DateInput
    //             value={value ?? ''}
    //             onChange={(event) => onChange(event.detail.value)}
    //             placeholder="YYYY/MM/DD"
    //           />{' '}
    //         </FormField>{' '}
    //         <Calendar
    //           value={value ?? ''}
    //           onChange={(event) => onChange(event.detail.value)}
    //           locale="en-GB"
    //         />{' '}
    //       </div>
    //     ),
    //     format: formatAwsDateTime,
    //     match: 'date',
    //   })),
    // },
    // {
    //   key: 'modelMD5Hash',
    //   propertyLabel: t('models.md5-hash'),
    //   operators: [':', '!:', '=', '!='],
    // },
    // {
    //   key: 'modelMetadataMD5Hash',
    //   propertyLabel: t('models.md5-hash-metadata'),
    //   operators: [':', '!:', '=', '!='],
    // },
    // {
    //   key: 'modelS3Key',
    //   propertyLabel: t('models.model-s3-key'),
    //   operators: [':', '!:', '=', '!='],
    // },
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));

  const visibleContentOptions = [
    {
      label: t('models.model-information'),
      options: [
        {
          id: 'modelId',
          label: t('models.model-id'),
        },
        {
          id: 'userName',
          label: t('models.user-name'),
          editable: false,
        },
        {
          id: 'modelName',
          label: t('models.model-name'),
          editable: false,
        },
        {
          id: 'modelDate',
          label: t('models.upload-date'),
        },
        {
          id: 'modelMD5Hash',
          label: t('models.md5-hash'),
        },
        {
          id: 'modelMetadataMD5Hash',
          label: t('models.md5-hash-metadata'),
        },
        {
          id: 'modelS3Key',
          label: t('models.model-s3-key'),
        },
      ],
    },
  ];

  const {
    items,
    actions,
    filteredItemsCount,
    collectionProps,
    propertyFilterProps,
    paginationProps,
  } = useCollection(allModels, {
    propertyFiltering: {
      filteringProperties,
      empty: <TableEmptyState resourceName="Model" />,
      noMatch: (
        <TableNoMatchState
          onClearFilter={() => {
            actions.setPropertyFiltering({ tokens: [], operation: 'and' });
          }}
          label={t('common.no-matches')}
          description={t('common.we-cant-find-a-match')}
          buttonLabel={t('button.clear-filters')}
        />
      ),
    },
    pagination: { pageSize: preferences.pageSize },
    sorting: { defaultState: { sortingColumn: adminModelsColsConfig[3], isDescending: true } },
    selection: {},
  });
  const [selectedItems, setSelectedItems] = useState([]);

  return (
    <PageLayout
      helpPanelHidden={helpPanelHidden}
      header={t('models.all-header')}
      description={t('models.list-of-all-uploaded-models')}
      breadcrumbs={[
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('admin.breadcrumb'), href: '/admin/home' },
        { text: t('models.breadcrumb') },
      ]}
    >
      <Table
        {...collectionProps}
        header={
          <Header
            counter={
              selectedItems.length
                ? `(${selectedItems.length}/${allModels.length})`
                : `(${allModels.length})`
            }
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  onClick={() => {
                    setSelectedItems([]);
                    setSelectedModelsBtn(true);
                  }}
                >
                  {t('button.clear-selected')}
                </Button>
                <CarModelUploadModal
                  disabled={selectedModelsBtn}
                  selectedModels={selectedItems}
                  cars={cars}
                ></CarModelUploadModal>
              </SpaceBetween>
            }
          >
            {t('models.all-header')}
          </Header>
        }
        columnDefinitions={adminModelsColsConfig}
        items={items}
        stripedRows={preferences.stripedRows}
        contentDensity={preferences.contentDensity}
        wrapLines={preferences.wrapLines}
        pagination={
          <Pagination
            {...paginationProps}
            ariaLabels={{
              nextPageLabel: t('table.next-page'),
              previousPageLabel: t('table.previous-page'),
              pageLabel: (pageNumber) => `$(t{'table.go-to-page')} ${pageNumber}`,
            }}
          />
        }
        filter={
          <PropertyFilter
            {...propertyFilterProps}
            i18nStrings={PropertyFilterI18nStrings('models')}
            countText={MatchesCountText(filteredItemsCount)}
            filteringAriaLabel={t('models.filter-groups')}
            expandToViewport={true}
          />
        }
        loading={modelsIsLoading || carsIsLoading}
        loadingText={t('models.loading-models')}
        visibleColumns={preferences.visibleContent}
        selectedItems={selectedItems}
        selectionType="multi"
        stickyHeader="true"
        trackBy={'key'}
        onSelectionChange={({ detail: { selectedItems } }) => {
          setSelectedItems(selectedItems);
          selectedItems.length ? setSelectedModelsBtn(false) : setSelectedModelsBtn(true);
        }}
        resizableColumns
        preferences={
          <TablePreferences
            preferences={preferences}
            setPreferences={setPreferences}
            contentOptions={visibleContentOptions}
          />
        }
      />
    </PageLayout>
  );
};

export { AdminModels };
