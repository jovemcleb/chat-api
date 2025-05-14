import bcrypt from "bcryptjs";
import { DataTypes, Model } from "sequelize";
import sequelize from "../db";
import { IUser } from "../interfaces/userInterface";

class User extends Model<IUser> implements IUser {
  public id!: number;
  public username!: string;
  public email!: string;
  public password!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Método para autenticação
  public static async authenticate(
    email: string,
    password: string
  ): Promise<User | null> {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    return isPasswordValid ? user : null;
  }

  // Método para hashear a senha
  public static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  public async updatePassword(newPassword: string): Promise<void> {
    this.password = newPassword;
    await this.save(); // O hook beforeUpdate fará o hash automaticamente
  }

  // Método para obter dados públicos do usuário (sem senha)
  public getPublicData(): { id: number; username: string; email: string } {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
    };
  }
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 50],
      },
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [8, 100],
      },
    },
  },
  {
    sequelize,
    modelName: "User",
    timestamps: true,
    hooks: {
      beforeCreate: async (user: User) => {
        if (user.password) {
          user.password = await User.hashPassword(user.password);
        }
      },
      beforeUpdate: async (user: User) => {
        // Só re-hash se a senha foi modificada
        if (user.changed("password")) {
          user.password = await User.hashPassword(user.password);
        }
      },
    },
  }
);

export default User;
