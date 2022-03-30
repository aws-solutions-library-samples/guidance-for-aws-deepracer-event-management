import React, { Component } from 'react';
import { API } from 'aws-amplify';
import {  Header, Table, Button } from 'semantic-ui-react';

class AdminCars extends Component {
  constructor(props) {
    super(props);
    this.containerDiv = React.createRef();
    this.state = {
      result: '',
      cars: [],
      view: 'list',
    };
  }

  componentDidMount = async () => {
    //Get Cars
    async function getCars() {
      console.log("Collecting cars...")
    
      const apiName = 'deepracerEventManager';
      const apiPath = 'cars';
    
      let response = await API.get(apiName, apiPath);
      return response
    }

    let cars = await getCars();
    this.setState({ cars: cars })
    //console.log(cars);

    this._isMounted = true;
  }

  AllModelDeleteHandler = async(clickitem) => {
    console.log(clickitem)
    //this.componentDidMount()
    async function deleteAllModels(car) {
      console.log("Deleting all models")
    
      const apiName = 'deepracerEventManager';
      const apiPath = 'cars/delete_all_models';
      const myInit = { 
        body: {
          InstanceId: car.InstanceId,
        }
      };
  
      let response = await API.post(apiName, apiPath, myInit);    
      return response
    }

    let deleting = await deleteAllModels(clickitem);
    console.log(deleting)
    this.setState({ result: deleting })
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  render() {
    let tablerows = this.state.cars.map(function (car, i) {
      let carID = car['InstanceId']
      let carName = car['Name']+' - '+car['IPAddress']
      return <Table.Row key={i} >
        <Table.Cell>{carID} </Table.Cell>
        <Table.Cell>{carName} </Table.Cell>
        <Table.Cell><Button negative circular icon='delete' onClick={() => {if(window.confirm('Are you sure to delete all models from this car?')){ this.AllModelDeleteHandler(car)};}}/></Table.Cell>
      </Table.Row>
    }.bind(this));

    let content = ''
    
    if (this.state.view === 'list'){
      content = <Table celled striped>
      <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Car ID</Table.HeaderCell>
            <Table.HeaderCell>Car Name</Table.HeaderCell>
            <Table.HeaderCell>Delete All Models</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {tablerows}
        </Table.Body>
      </Table>
    }

    return (
      <div>
        <Header as='h1' icon textAlign='center'>Admin Cars (Online)</Header>
        {content}
      </div>
    )
  }
}

export {AdminCars}