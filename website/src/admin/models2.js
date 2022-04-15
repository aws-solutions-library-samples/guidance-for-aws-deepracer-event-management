import React, { Component, useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import { Container, Header, Table, Checkbox, } from 'semantic-ui-react';

import CarModelUploadModal from "./carModelUploadModal.js";
import { useTable, useSortBy, useRowSelect } from 'react-table'

const IndeterminateCheckbox = React.forwardRef(
  ({ indeterminate, ...rest }, ref) => {
    const defaultRef = React.useRef()
    const resolvedRef = ref || defaultRef

    React.useEffect(() => {
      resolvedRef.current.indeterminate = indeterminate
    }, [resolvedRef, indeterminate])

    return (
      <>
        <input type="checkbox" ref={resolvedRef} {...rest} />
      </>
    )
  }
)

function AdminModels2() {
  const [data, setData] = useState([]);
  const [cars, setCars] = useState([]);


  useEffect(() => {
    async function getModels() {
      console.log("Collecting models...")
    
      const apiName = 'deepracerEventManager';
      const apiPath = 'models';
    
      const response = await API.get(apiName, apiPath);
      setData(response);
    }

    // async function getCars() {
    //   console.log("Collecting cars...")
    
    //   const apiName = 'deepracerEventManager';
    //   const apiPath = 'cars';
    
    //   const response = await API.get(apiName, apiPath);
    //   setCars(response);
    // }

    getModels();
    //getCars();
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
    ],
    []
  )

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    selectedFlatRows,
    state: { selectedRowIds },
  } = useTable(
    {
      columns,
      data,
    },
    useSortBy,
    useRowSelect,
    hooks => {
      hooks.visibleColumns.push(columns => [
        // Let's make a column for selection
        {
          id: 'selection',
          // The header can use the table's getToggleAllRowsSelectedProps method
          // to render a checkbox
          Header: ({ getToggleAllRowsSelectedProps }) => (
            <div>
              <IndeterminateCheckbox {...getToggleAllRowsSelectedProps()} />
            </div>
          ),
          // The cell can use the individual row's getToggleRowSelectedProps method
          // to the render a checkbox
          Cell: ({ row }) => (
            <div>
              <IndeterminateCheckbox {...row.getToggleRowSelectedProps()} />
            </div>
          ),
        },
        ...columns,
      ])
    }
  )

  return (
    <>
      <table {...getTableProps()}>
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
          {rows.map((row, i) => {
            prepareRow(row)
            return (
              <tr {...row.getRowProps()}>
                {row.cells.map(cell => {
                  return <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p>Selected Rows: {Object.keys(selectedRowIds).length}</p>
      <pre>
        <code>
          {JSON.stringify(
            {
              selectedRowIds: selectedRowIds,
              'selectedFlatRows[].original': selectedFlatRows.map(
                d => d.original
              ),
            },
            null,
            2
          )}
        </code>
      </pre>
    </>
  )
}

export {AdminModels2}