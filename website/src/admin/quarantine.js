import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import { Header, Table, Icon, Input } from 'semantic-ui-react';
import { useTable, useSortBy, useRowSelect, useFilters } from 'react-table'

import dayjs from 'dayjs';

// day.js
var advancedFormat = require('dayjs/plugin/advancedFormat')
var utc = require('dayjs/plugin/utc')
var timezone = require('dayjs/plugin/timezone') // dependent on utc plugin

dayjs.extend(advancedFormat)
dayjs.extend(utc)
dayjs.extend(timezone)

// Define a default UI for filtering
function DefaultColumnFilter({
  column: { filterValue, preFilteredRows, setFilter },
}) {
  const count = preFilteredRows.length

  return (
    <Input
      icon={{ name: 'search', circular: true }}
      value={filterValue || ''}
      onChange={e => {
        setFilter(e.target.value || undefined) // Set undefined to remove the filter entirely
      }}
      placeholder={`Search ${count} records...`}
    />
  )
}

function AdminQuarantine() {
  const [data, setData] = useState([]);

  useEffect(() => {
    async function getQuarantinedModels() {
      console.log("Collecting models...")

      const apiName = 'deepracerEventManager';
      const apiPath = 'admin/quarantinedmodels';

      const response = await API.get(apiName, apiPath);
      setData(response);
    }

    getQuarantinedModels();
  },[])

  const columns = React.useMemo(
    () => [
      {
        Header: 'User',
        accessor: (row) => {
          const modelKeyPieces = (row.Key.split('/'));
          return modelKeyPieces[modelKeyPieces.length - 3];
        },
      },
      {
        Header: 'Model',
        accessor: (row) => {
          const modelKeyPieces = (row.Key.split('/'));
          return modelKeyPieces[modelKeyPieces.length - 1].split('.')[0];
        },
      },
      {
        Header: 'Date / Time Uploaded',
        disableFilters: true,
        accessor: (row) => {
          const modelDate = dayjs(row.LastModified).format('YYYY-MM-DD HH:mm:ss (z)');
          return modelDate;
        },
      },
    ],
    []
  )

  const defaultColumn = React.useMemo(
    () => ({
      // Let's set up our default Filter UI
      Filter: DefaultColumnFilter,
    }),
    []
  )

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    //state: { selectedRowIds },
  } = useTable(
    {
      columns,
      data,
      defaultColumn, // Be sure to pass the defaultColumn option
    },
    useFilters,
    useSortBy,
    useRowSelect
  )

  return (
    <>
      <Header as='h1' icon textAlign='center'>Quarantined Models</Header>
      <Table celled striped {...getTableProps()}>
        <Table.Header>
          {headerGroups.map(headerGroup => (
            <Table.Row {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map(column => (
                <Table.HeaderCell {...column.getHeaderProps(column.getSortByToggleProps())}>
                  <div>
                    {column.render('Header')}
                    {column.canSort
                      ? column.isSorted
                        ? column.isSortedDesc
                          ? <Icon name='sort down' />
                          : <Icon name='sort up' />
                        : <Icon disabled name='sort' />
                      : ''}
                    {column.canFilter ? column.render('Filter') : null}
                  </div>
                </Table.HeaderCell>
              ))}
            </Table.Row>
          ))}
        </Table.Header>
        <Table.Body {...getTableBodyProps()}>
          {rows.map((row, i) => {
            prepareRow(row)
            return (
              <Table.Row {...row.getRowProps()}>
                {row.cells.map(cell => {
                  return <Table.Cell {...cell.getCellProps()}>{cell.render('Cell')}</Table.Cell>
                })}
              </Table.Row>
            )
          })}
        </Table.Body>
      </Table>
    </>
  )
}

export {AdminQuarantine}
