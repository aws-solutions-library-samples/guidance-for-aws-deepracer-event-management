import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import { Container, Header, Table, Icon, Menu, Input } from 'semantic-ui-react';

import CarModelUploadModal from "./carModelUploadModal.js";
import { useTable, useSortBy, useRowSelect, useFilters } from 'react-table'

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
        {/* <Checkbox ref={resolvedRef} {...rest}/> */}
      </>
    )
  }
)

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

function AdminModels() {
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

    async function getCars() {
      console.log("Collecting cars...")
    
      const apiName = 'deepracerEventManager';
      const apiPath = 'cars';
    
      const response = await API.get(apiName, apiPath);
      setCars(response);
    }

    getModels();
    getCars();
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
    selectedFlatRows,
    //state: { selectedRowIds },
  } = useTable(
    {
      columns,
      data,
      defaultColumn, // Be sure to pass the defaultColumn option
    },
    useFilters,
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
      <Header as='h1' icon textAlign='center'>Admin Models</Header>
      <Table celled striped {...getTableProps()}>
        <Table.Header>
          {headerGroups.map(headerGroup => (
            <Table.Row {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map(column => (
                <Table.HeaderCell {...column.getHeaderProps(column.getSortByToggleProps())}>
                  {column.render('Header')}
                  <span>
                    {column.canSort
                      ? column.isSorted
                        ? column.isSortedDesc
                          ? <Icon name='sort down' />
                          : <Icon name='sort up' />
                        : <Icon disabled name='sort' />
                      : ''}
                  </span>
                  <div>{column.canFilter ? column.render('Filter') : null}</div>
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
      
      <Menu fixed='bottom'>
        <Menu.Item>
          <CarModelUploadModal cars={cars} models={selectedFlatRows} />
        </Menu.Item>
      </Menu>

      {/* <Container textAlign='center'>
        <CarModelUploadModal cars={cars} models={selectedFlatRows} />
      </Container> */}

      <Container textAlign='center'>
        <br></br>
        <br></br>
      </Container>
      {/* <p>Selected Rows: {Object.keys(selectedRowIds).length}</p>
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
      </pre> */}
    </>
  )
}

export {AdminModels}