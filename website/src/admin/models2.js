import React, { Component, useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import { Container, Header, Table, Checkbox, } from 'semantic-ui-react';

import CarModelUploadModal from "./carModelUploadModal.js";
import { useTable, useSortBy } from 'react-table'

async function getCars() {
  console.log("Collecting cars...")

  const apiName = 'deepracerEventManager';
  const apiPath = 'cars';

  const response = await API.get(apiName, apiPath);
  //console.log(response);
  return response;
}

function AdminModels2() {
  const [data, setData] = useState([]);

  useEffect(() => {
    async function getModels() {
      console.log("Collecting models...")
    
      const apiName = 'deepracerEventManager';
      const apiPath = 'models';
    
      const response = await API.get(apiName, apiPath);
      setData(response);
    }
    getModels();
  },[])
  //setData(getModels());

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
    ],
    []
  )

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable(
    { columns, data },
    useSortBy
  )

  return (
    <table {...getTableProps()} style={{ border: 'solid 1px blue' }}>
      <thead>
        {headerGroups.map(headerGroup => (
          <tr {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map(column => (
              <th {...column.getHeaderProps(column.getSortByToggleProps())}>
                {column.render('Header')}
                <span>
                  {column.isSorted
                    ? column.isSortedDesc
                      ? ' 🔽'
                      : ' 🔼'
                    : ''}
                </span>
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map(row => {
          prepareRow(row)
          return (
            <tr {...row.getRowProps()}>
              {row.cells.map(cell => {
                return (
                  <td
                    {...cell.getCellProps()}
                    style={{
                      padding: '10px',
                      border: 'solid 1px gray',
                      background: 'papayawhip',
                    }}
                  >
                    {cell.render('Cell')}
                  </td>
                )
              })}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export {AdminModels2}