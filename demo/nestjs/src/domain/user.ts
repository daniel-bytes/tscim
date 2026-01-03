import { Entity } from './entity';

export class User extends Entity {
  userName: string;
  managerId?: string;
  teamIds?: string[];
  email: {
    primary: string;
    alternate?: string;
  };
  name: {
    firstName: string;
    lastName?: string;
  };
  phone?: {
    primary: string;
    alternate?: string;
  };
  address?: {
    street: string;
    street2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  attributes?: Record<string, string | number | boolean>;

  get fullName(): string {
    return this.name.lastName
      ? `${this.name.firstName} ${this.name.lastName}`
      : this.name.firstName;
  }
}
